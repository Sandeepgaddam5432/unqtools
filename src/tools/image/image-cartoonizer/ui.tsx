"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  cartoonize,
  statsToCsv,
  cartoonCssFilter,
  PRESETS,
  type CartoonMode,
  type CartoonResult,
  type CartoonInput,
} from "./logic";
import { toast } from "sonner";

export default function ImageCartoonizer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("cartoon.png");
  const [edgeThreshold, setEdgeThreshold] = useState(60);
  const [edgeThickness, setEdgeThickness] = useState(2);
  const [colorLevels, setColorLevels] = useState(6);
  const [smoothing, setSmoothing] = useState(0.3);
  const [intensity, setIntensity] = useState(0.85);
  const [mode, setMode] = useState<CartoonMode>("cartoon");
  const [inputBlack, setInputBlack] = useState(0);
  const [inputWhite, setInputWhite] = useState(255);
  const [gamma, setGamma] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CartoonResult | null>(null);
  const [batchQueue, setBatchQueue] = useState<HTMLImageElement[]>([]);
  const [batchIdx, setBatchIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-cartoon.png"); setError(null); setPreviewUrl(null); setResult(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const onBatchFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imgs: HTMLImageElement[] = [];
    let loaded = 0;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    arr.forEach((file, i) => {
      const img = new Image();
      img.onload = () => {
        imgs[i] = img;
        loaded++;
        if (loaded === arr.length) {
          setBatchQueue(imgs);
          setBatchIdx(0);
          setImage(imgs[0] ?? null);
          if (imgs[0]) setFileName("cartoon-1.png");
          toast.success(`Loaded ${arr.length} images for batch`);
        }
      };
      img.onerror = () => { loaded++; };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const buildInput = useCallback((): CartoonInput | null => {
    if (!image || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return {
      width: canvas.width, height: canvas.height, pixels: data,
      edgeThreshold, edgeThickness, colorLevels, smoothing, intensity, mode,
      inputBlack, inputWhite, gamma,
    };
  }, [image, edgeThreshold, edgeThickness, colorLevels, smoothing, intensity, mode, inputBlack, inputWhite, gamma]);

  const apply = useCallback(() => {
    const input = buildInput();
    if (!input) { setError("Load an image first"); return; }
    setError(null);
    const r = cartoonize(input);
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imgData = new ImageData(new Uint8ClampedArray(r.pixels), canvas.width, canvas.height);
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
    toast.success("Cartoon applied");
  }, [buildInput, previewUrl]);

  const applyPreset = useCallback((p: (typeof PRESETS)[number]) => {
    const v = p.value;
    setEdgeThreshold(v.edgeThreshold);
    setEdgeThickness(v.edgeThickness);
    setColorLevels(v.colorLevels);
    setSmoothing(v.smoothing);
    setIntensity(v.intensity);
    setMode(v.mode);
  }, []);

  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Downloaded");
    }, "image/png");
  }, [fileName]);

  const nextBatch = useCallback(() => {
    if (batchQueue.length === 0) return;
    const ni = (batchIdx + 1) % batchQueue.length;
    setBatchIdx(ni);
    setImage(batchQueue[ni]!);
    setFileName(`cartoon-${ni + 1}.png`);
    setPreviewUrl(null);
    setResult(null);
  }, [batchQueue, batchIdx]);

  const cssFilter = useMemo(() => cartoonCssFilter({
    width: 1, height: 1, pixels: new Uint8ClampedArray(4),
    edgeThreshold, edgeThickness, colorLevels, smoothing, intensity, mode,
  }), [edgeThreshold, edgeThickness, colorLevels, smoothing, intensity, mode]);

  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <input id="batch-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => onBatchFiles(e.target.files)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <Button variant="outline" size="sm" onClick={() => document.getElementById("batch-input")?.click()}>Batch (multiple)</Button>
            {batchQueue.length > 0 && (
              <Button variant="ghost" size="sm" onClick={nextBatch}>Next in batch ({batchIdx + 1}/{batchQueue.length})</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRESETS.map((p) => (
                <Button key={p.name} size="sm" variant="outline" onClick={() => applyPreset(p)}>{p.name}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={mode === "cartoon" ? "default" : "outline"} onClick={() => setMode("cartoon")}>Cartoon</Button>
              <Button size="sm" variant={mode === "sketch" ? "default" : "outline"} onClick={() => setMode("sketch")}>Sketch</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Edge threshold: {edgeThreshold}</Label>
              <input type="range" min={0} max={255} value={edgeThreshold} onChange={(e) => setEdgeThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Edge thickness: {edgeThickness}</Label>
              <input type="range" min={1} max={5} value={edgeThickness} onChange={(e) => setEdgeThickness(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Color levels: {colorLevels}</Label>
              <input type="range" min={2} max={32} value={colorLevels} onChange={(e) => setColorLevels(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Smoothing: {smoothing.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={smoothing} onChange={(e) => setSmoothing(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {intensity.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Gamma: {gamma.toFixed(2)}</Label>
              <input type="range" min={0.2} max={3} step={0.05} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Input black: {inputBlack}</Label>
              <input type="range" min={0} max={255} value={inputBlack} onChange={(e) => setInputBlack(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Input white: {inputWhite}</Label>
              <input type="range" min={0} max={255} value={inputWhite} onChange={(e) => setInputWhite(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!image}>Apply cartoon</Button>
            <Button variant="outline" size="sm" onClick={downloadPng} disabled={!previewUrl}>Download PNG</Button>
            <CopyButton getText={() => cssFilter} label="Copy CSS filter" />
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="cartoon-stats.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Cartoon preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Stats</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Pixels</p><p className="font-bold">{result.stats.pixels.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Edge pixels</p><p className="font-bold">{result.stats.edgePixels.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Edge ratio</p><p className="font-bold">{(result.stats.edgeRatio * 100).toFixed(1)}%</p></div>
              <div><p className="text-xs text-muted-foreground">Unique colors</p><p className="font-bold">{result.stats.uniqueColors.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Render time</p><p className="font-bold">{result.stats.durationMs.toFixed(1)}ms</p></div>
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> cartoon rendering runs locally via Canvas. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}
