"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { applyToRgba, denoiseStats, validateDenoiseOptions, buildDenoiseFilename, DEFAULT_OPTIONS, type DenoiseOptions, type DenoiseMode } from "./logic";
import { toast } from "sonner";

const MODES: { value: DenoiseMode; label: string }[] = [
  { value: "median", label: "Median (salt/pepper)" },
  { value: "bilateral", label: "Bilateral (edge-aware)" },
  { value: "nlm", label: "Non-local Means" },
  { value: "wavelet", label: "Wavelet (Haar)" },
  { value: "ml", label: "ML-style (fast)" },
];

export default function ImageNoiseReducer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("denoised.png");
  const [opts, setOpts] = useState<DenoiseOptions>(DEFAULT_OPTIONS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{ meanAbsDelta: number; maxAbsDelta: number; changedPct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof DenoiseOptions>(key: K, value: DenoiseOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(buildDenoiseFilename(file.name, "median"));
      setError(null);
      setPreviewUrl(null);
      setStats(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateDenoiseOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const original = new Uint8ClampedArray(data.data);
    const result = applyToRgba(data.data, canvas.width, canvas.height, opts);
    data.data.set(result);
    ctx.putImageData(data, 0, 0);
    setStats(denoiseStats(original, result));
    setFileName(buildDenoiseFilename(fileName.replace(/-denoised-.*\.png$/, ""), opts.mode));
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
    // before snapshot
    const beforeCanvas = document.createElement("canvas");
    beforeCanvas.width = canvas.width;
    beforeCanvas.height = canvas.height;
    const bctx = beforeCanvas.getContext("2d");
    if (bctx) {
      const bd = bctx.createImageData(canvas.width, canvas.height);
      bd.data.set(original);
      bctx.putImageData(bd, 0, 0);
      beforeCanvas.toBlob((blob) => {
        if (!blob) return;
        if (beforeUrl) URL.revokeObjectURL(beforeUrl);
        setBeforeUrl(URL.createObjectURL(blob));
      }, "image/png");
    }
  }, [image, opts, previewUrl, beforeUrl, fileName]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [fileName]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select value={opts.mode} onChange={(e) => update("mode", e.target.value as DenoiseMode)} className="h-9 rounded-md border bg-background px-3 text-sm w-full">
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Window radius: {opts.radius} ({opts.radius * 2 + 1}×{opts.radius * 2 + 1})</Label>
              <Slider value={[opts.radius]} onValueChange={(v) => update("radius", v[0]!)} min={1} max={5} step={1} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Overall strength: {opts.strength}%</Label>
              <Slider value={[opts.strength]} onValueChange={(v) => update("strength", v[0]!)} min={0} max={100} step={5} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Luma noise: {opts.lumaStrength}%</Label>
                <Slider value={[opts.lumaStrength]} onValueChange={(v) => update("lumaStrength", v[0]!)} min={0} max={100} step={5} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Chroma noise: {opts.chromaStrength}%</Label>
                <Slider value={[opts.chromaStrength]} onValueChange={(v) => update("chromaStrength", v[0]!)} min={0} max={100} step={5} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Detail preservation: {opts.detail}%</Label>
                <Slider value={[opts.detail]} onValueChange={(v) => update("detail", v[0]!)} min={0} max={100} step={5} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Grain add-back: {opts.grain}%</Label>
                <Slider value={[opts.grain]} onValueChange={(v) => update("grain", v[0]!)} min={0} max={100} step={5} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={opts.deblock} onCheckedChange={(v) => update("deblock", v)} id="deblock" />
              <Label htmlFor="deblock" className="text-sm cursor-pointer">JPEG de-block (8×8 smoothing)</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Seed</Label>
              <Input type="number" value={opts.seed} onChange={(e) => update("seed", Number(e.target.value))} className="w-32" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={apply}>Denoise</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={fileName} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
            </div>
            {stats && (
              <p className="text-xs text-muted-foreground">
                Δ mean {stats.meanAbsDelta.toFixed(1)} · max {stats.maxAbsDelta} · changed {stats.changedPct.toFixed(0)}%
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {beforeUrl && previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Before / after</p>
            <div className="grid grid-cols-2 gap-2">
              <img src={beforeUrl} alt="Before" className="w-full rounded-md border" />
              <img src={previewUrl} alt="After" className="w-full rounded-md border" />
            </div>
          </CardContent>
        </Card>
      )}
      {previewUrl && !beforeUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Denoised preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all denoise runs locally via Canvas API — images never leave your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
