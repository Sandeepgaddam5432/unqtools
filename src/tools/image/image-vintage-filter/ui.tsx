"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, PRESETS, processImage, withPreset, describeSettings,
  formatBytes, estimatePngBytes, type VintageParams, type VintagePreset,
} from "./logic";

export default function ImageVintageFilterUI() {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [originalPixels, setOriginalPixels] = useState<Uint8ClampedArray | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [params, setParams] = useState<VintageParams>({ ...DEFAULT_PARAMS });
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processed = useMemo(() => {
    if (!originalPixels) return null;
    return processImage(originalPixels, width, height, params);
  }, [originalPixels, width, height, params]);

  useEffect(() => {
    if (!processed || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const imgData = new ImageData(processed, width, height);
    ctx.putImageData(imgData, 0, 0);
  }, [processed, width, height]);

  const estBytes = useMemo(() => estimatePngBytes(width, height), [width, height]);

  const onFile = useCallback(async (f: File) => {
    setError("");
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      // Downscale large images
      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      setOriginalPixels(new Uint8ClampedArray(data));
      setImgEl(img);
      setWidth(w);
      setHeight(h);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError("Failed to load image.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const setPreset = useCallback((preset: VintagePreset) => {
    setParams((p) => withPreset(preset, {
      grain: p.grain,
      vignette: p.vignette,
    }));
  }, []);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vintage-${params.preset}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [params.preset]);

  const updateSplit = useCallback((key: "highlights" | "shadows", idx: number, value: number) => {
    setParams((p) => {
      const copy = { ...p.splitTone };
      const arr = [...copy[key]] as [number, number, number];
      arr[idx] = value;
      copy[key] = arr;
      return { ...p, splitTone: copy };
    });
  }, []);

  const settings = useMemo(() => describeSettings(params), [params]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload image</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {imgEl && (
            <p className="text-xs text-muted-foreground">Source: {width}×{height}px — estimated output {formatBytes(estBytes)}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} disabled={!imgEl} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">Download PNG</button>
            <CopyButton getText={() => settings} disabled={!imgEl} label="Copy settings" />
            <DownloadButton getText={() => settings} filename="vintage-settings.txt" disabled={!imgEl} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Preset</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as VintagePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`text-xs px-3 py-1.5 rounded-md border ${params.preset === p ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Tone controls</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Slider label="Grain" value={params.grain} min={0} max={1} step={0.01} onChange={(v) => setParams((p) => ({ ...p, grain: v }))} />
            <Slider label="Vignette" value={params.vignette} min={0} max={1} step={0.01} onChange={(v) => setParams((p) => ({ ...p, vignette: v }))} />
            <Slider label="Fade" value={params.fade} min={0} max={1} step={0.01} onChange={(v) => setParams((p) => ({ ...p, fade: v }))} />
            <Slider label="Contrast" value={params.contrast} min={0.5} max={1.5} step={0.01} onChange={(v) => setParams((p) => ({ ...p, contrast: v }))} />
            <Slider label="Brightness" value={params.brightness} min={0.5} max={1.5} step={0.01} onChange={(v) => setParams((p) => ({ ...p, brightness: v }))} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Highlights R/G/B</Label>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <Input key={i} type="number" min={0} max={255} value={params.splitTone.highlights[i]} onChange={(e) => updateSplit("highlights", i, Math.min(255, Math.max(0, Number(e.target.value))))} />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Shadows R/G/B</Label>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <Input key={i} type="number" min={0} max={255} value={params.splitTone.shadows[i]} onChange={(e) => updateSplit("shadows", i, Math.min(255, Math.max(0, Number(e.target.value))))} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Preview</p>
          {imgEl ? (
            <canvas ref={canvasRef} className="border border-border rounded-md max-w-full" />
          ) : (
            <p className="text-xs text-muted-foreground">Upload an image to apply the vintage filter.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> filter is applied locally. Grain uses a seeded LCG; split-toning tints highlights and shadows based on pixel luminance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
