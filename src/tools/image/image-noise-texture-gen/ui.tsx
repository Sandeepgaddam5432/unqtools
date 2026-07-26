"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, renderNoise, renderTileableNoise, noiseStats, estimatePngBytes,
  formatBytes, type NoiseParams, type NoiseType,
} from "./logic";

export default function ImageNoiseTextureGenUI() {
  const [params, setParams] = useState<NoiseParams>({ ...DEFAULT_PARAMS });
  const [tileable, setTileable] = useState(false);
  const [seedShuffle, setSeedShuffle] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pixels = useMemo(() => {
    return tileable ? renderTileableNoise(params) : renderNoise(params);
  }, [params, tileable]);

  const stats = useMemo(() => noiseStats(pixels), [pixels]);
  const estBytes = useMemo(() => estimatePngBytes(params.width, params.height), [params.width, params.height]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = params.width;
    canvasRef.current.height = params.height;
    const imageData = new ImageData(pixels, params.width, params.height);
    ctx.putImageData(imageData, 0, 0);
  }, [pixels, params.width, params.height]);

  const update = useCallback(<K extends keyof NoiseParams>(key: K, value: NoiseParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noise-${params.type}-${params.seed}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [params]);

  const csv = useMemo(() => {
    return [
      "Property,Value",
      `Type,${params.type}`,
      `Width,${params.width}`,
      `Height,${params.height}`,
      `Frequency,${params.frequency}`,
      `Octaves,${params.octaves}`,
      `Persistence,${params.persistence}`,
      `Lacunarity,${params.lacunarity}`,
      `Seed,${params.seed}`,
      `Tileable,${tileable ? "yes" : "no"}`,
      `Min,${stats.min}`,
      `Max,${stats.max}`,
      `Mean,${stats.mean}`,
      `Std,${stats.std}`,
      `EstBytes,${estBytes}`,
    ].join("\n");
  }, [params, tileable, stats, estBytes]);

  return (
    <div className="space-y-4">
      {params.width <= 0 || params.height <= 0 ? (
        <ErrorBanner message="Width and height must be positive." />
      ) : null}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Parameters</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full"
                value={params.type}
                onChange={(e) => update("type", e.target.value as NoiseType)}
              >
                <option value="perlin">Perlin</option>
                <option value="simplex">Simplex</option>
                <option value="value">Value</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input type="number" min={8} max={1024} value={params.width} onChange={(e) => update("width", Math.max(8, Math.min(1024, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input type="number" min={8} max={1024} value={params.height} onChange={(e) => update("height", Math.max(8, Math.min(1024, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Seed</Label>
              <Input type="number" value={params.seed} onChange={(e) => update("seed", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frequency</Label>
              <Input type="number" step={0.1} min={0.1} value={params.frequency} onChange={(e) => update("frequency", Math.max(0.1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Octaves</Label>
              <Input type="number" min={1} max={8} value={params.octaves} onChange={(e) => update("octaves", Math.max(1, Math.min(8, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Persistence</Label>
              <Input type="number" step={0.05} min={0} max={1} value={params.persistence} onChange={(e) => update("persistence", Math.max(0, Math.min(1, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lacunarity</Label>
              <Input type="number" step={0.1} min={1} value={params.lacunarity} onChange={(e) => update("lacunarity", Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={tileable} onChange={(e) => setTileable(e.target.checked)} />
              Tileable
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!params.invert} onChange={(e) => update("invert", e.target.checked)} />
              Invert
            </label>
            <label className="flex items-center gap-2 text-xs">
              Threshold
              <Input
                type="number" step={0.05} min={0} max={1}
                value={params.threshold ?? ""}
                onChange={(e) => update("threshold", e.target.value === "" ? undefined : Number(e.target.value))}
                className="w-24"
              />
            </label>
            <button
              type="button"
              onClick={() => { setSeedShuffle((s) => s + 1); update("seed", Math.floor(Math.random() * 1e9)); }}
              className="text-xs px-3 py-1.5 rounded-md border border-border"
            >
              Randomize seed
            </button>
            <button
              type="button"
              onClick={download}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
            >
              Download PNG
            </button>
            <CopyButton getText={() => csv} label="Copy CSV" />
            <DownloadButton getText={() => csv} filename="noise-stats.csv" mime="text/csv" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Preview</p>
          <canvas ref={canvasRef} className="border border-border rounded-md max-w-full" style={{ imageRendering: "pixelated" }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Min" value={String(stats.min)} />
            <Stat label="Max" value={String(stats.max)} />
            <Stat label="Mean" value={String(stats.mean)} />
            <Stat label="Std dev" value={String(stats.std)} />
          </div>
          <p className="text-xs text-muted-foreground">Estimated PNG size: {formatBytes(estBytes)} (random data compresses poorly)</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> noise is generated locally with a seeded PRNG (mulberry32). Perlin/Simplex/Value noise use a 256-entry permutation table; FBM sums multiple octaves with persistence falloff.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
