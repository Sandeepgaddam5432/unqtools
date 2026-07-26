"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  removeBackground,
  statsToCsv,
  hexToRgb,
  type SelectionMode,
  type TransparentPngResult,
} from "./logic";
import { toast } from "sonner";

export default function ImageTransparentPngMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("transparent.png");
  const [targetColor, setTargetColor] = useState("#ffffff");
  const [extraColors, setExtraColors] = useState<string[]>([]);
  const [tolerance, setTolerance] = useState(30);
  const [mode, setMode] = useState<SelectionMode>("global");
  const [feather, setFeather] = useState(2);
  const [invert, setInvert] = useState(false);
  const [useReplacement, setUseReplacement] = useState(false);
  const [replacementColor, setReplacementColor] = useState("#ff0000");
  const [seed, setSeed] = useState<{ x: number; y: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checkerUrl, setCheckerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransparentPngResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-transparent.png");
      setError(null);
      setPreviewUrl(null);
      setResult(null);
      setSeed(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * image.naturalWidth);
    const y = Math.round((e.clientY - rect.top) / rect.height * image.naturalHeight);
    setSeed({ x, y });
    // Sample color at that point
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const px = ctx.getImageData(x, y, 1, 1).data;
    setTargetColor("#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
    toast.success(`Seed at (${x},${y})`);
  }, [image]);

  const buildTargets = useCallback((): Array<[number, number, number]> => {
    const targets: Array<[number, number, number]> = [];
    const main = hexToRgb(targetColor);
    if (!("error" in main)) targets.push(main);
    for (const c of extraColors) {
      const r = hexToRgb(c);
      if (!("error" in r)) targets.push(r);
    }
    return targets;
  }, [targetColor, extraColors]);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets = buildTargets();
    if (targets.length === 0) { setError("Invalid target color"); return; }
    const replacement = (() => {
      if (!useReplacement) return null;
      const r = hexToRgb(replacementColor);
      return "error" in r ? null : r;
    })();
    const r = removeBackground({
      width: canvas.width, height: canvas.height, pixels: data,
      targetColors: targets, tolerance, mode, feather,
      replacementColor: replacement,
      invert,
      seed: mode === "contiguous" ? (seed ?? { x: 0, y: 0 }) : undefined,
    });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    const imgData = new ImageData(new Uint8ClampedArray(r.pixels), canvas.width, canvas.height);
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
    toast.success("Background removed");
  }, [image, buildTargets, tolerance, mode, feather, invert, useReplacement, replacementColor, seed, previewUrl]);

  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PNG downloaded");
    }, "image/png");
  }, [fileName]);

  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Target color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={targetColor} onChange={(e) => setTargetColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
                <Input className="text-xs" value={targetColor} onChange={(e) => setTargetColor(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Extra colors</Label>
              <div className="flex gap-2 items-center">
                <input type="color" onChange={(e) => setExtraColors((c) => [...c, e.target.value])} className="h-9 w-12 rounded-md border bg-background" />
                <span className="text-xs text-muted-foreground">{extraColors.length} added</span>
                <Button size="sm" variant="ghost" onClick={() => setExtraColors([])}>Clear</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={mode === "global" ? "default" : "outline"} onClick={() => setMode("global")}>Global</Button>
                <Button size="sm" variant={mode === "contiguous" ? "default" : "outline"} onClick={() => setMode("contiguous")}>Contiguous</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tolerance: {tolerance}</Label>
              <input type="range" min={0} max={255} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Feather: {feather}px</Label>
              <input type="range" min={0} max={20} value={feather} onChange={(e) => setFeather(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Invert selection
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={useReplacement} onChange={(e) => setUseReplacement(e.target.checked)} /> Replace with color
              </label>
              {useReplacement && (
                <input type="color" value={replacementColor} onChange={(e) => setReplacementColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
              )}
            </div>
          </div>
          {mode === "contiguous" && (
            <div className="text-xs text-muted-foreground">
              Click the preview image to set a seed point. {seed ? `Current: (${seed.x}, ${seed.y})` : "No seed set"}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!image}>Remove background</Button>
            <Button variant="outline" size="sm" onClick={downloadPng} disabled={!previewUrl}>Download PNG</Button>
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="transparent-stats.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview (click to set seed for contiguous mode)</p>
            <div onClick={onCanvasClick} className="cursor-crosshair" style={{ backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px" }}>
              <img src={previewUrl} alt="Transparent preview" className="max-w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Stats</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold">{result.stats.totalPixels.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Removed</p><p className="font-bold text-emerald-600">{result.stats.removedPixels.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Kept</p><p className="font-bold">{result.stats.keptPixels.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Removed %</p><p className="font-bold">{(result.stats.removedRatio * 100).toFixed(1)}%</p></div>
              <div><p className="text-xs text-muted-foreground">Feathered</p><p className="font-bold">{result.stats.featheredPixels.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Render time</p><p className="font-bold">{result.stats.durationMs.toFixed(1)}ms</p></div>
            </div>
            {result.warnings.length > 0 && <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally via Canvas. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-9 rounded-md border bg-background px-3 text-sm ${className ?? ""}`} {...props} />;
}
