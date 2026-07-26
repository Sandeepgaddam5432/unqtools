"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generateHalftone,
  statsToCsv,
  luminance,
  type HalftonePattern,
  type ColorMode,
  type HalftoneResult,
} from "./logic";
import { toast } from "sonner";

const PATTERNS: { value: HalftonePattern; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
  { value: "ellipse", label: "Ellipse" },
  { value: "line", label: "Line" },
  { value: "cross", label: "Cross" },
  { value: "star", label: "Star" },
];

const MODES: { value: ColorMode; label: string }[] = [
  { value: "grayscale", label: "Grayscale" },
  { value: "cmyk", label: "CMYK" },
  { value: "rgb", label: "RGB" },
  { value: "monochrome", label: "Mono" },
];

const PRESETS: { name: string; cellSize: number; angle: number; intensity: number; pattern: HalftonePattern; colorMode: ColorMode }[] = [
  { name: "Newspaper", cellSize: 6, angle: 45, intensity: 1.2, pattern: "round", colorMode: "grayscale" },
  { name: "Comic", cellSize: 10, angle: 0, intensity: 1.5, pattern: "round", colorMode: "cmyk" },
  { name: "Pop Art", cellSize: 14, angle: 15, intensity: 1.8, pattern: "square", colorMode: "cmyk" },
  { name: "Fine Print", cellSize: 4, angle: 75, intensity: 1, pattern: "round", colorMode: "grayscale" },
];

export default function ImageHalftoneGenerator() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("halftone.png");
  const [cellSize, setCellSize] = useState(8);
  const [angle, setAngle] = useState(45);
  const [intensity, setIntensity] = useState(1.2);
  const [minDot, setMinDot] = useState(0.1);
  const [maxDot, setMaxDot] = useState(0.9);
  const [pattern, setPattern] = useState<HalftonePattern>("round");
  const [colorMode, setColorMode] = useState<ColorMode>("grayscale");
  const [invert, setInvert] = useState(false);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [svgText, setSvgText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HalftoneResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyPreset = useCallback((p: (typeof PRESETS)[number]) => {
    setCellSize(p.cellSize);
    setAngle(p.angle);
    setIntensity(p.intensity);
    setPattern(p.pattern);
    setColorMode(p.colorMode);
  }, []);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-halftone.png");
      setError(null);
      setPreviewUrl(null);
      setResult(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(image, 0, 0);
    const src = tctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const r = generateHalftone({
      width: canvas.width,
      height: canvas.height,
      pixels: src,
      pattern,
      cellSize,
      angle,
      minDotSize: minDot,
      maxDotSize: maxDot,
      intensity,
      invert,
      fgColor,
      bgColor,
      colorMode,
    });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    setSvgText(r.svg);
    // Render SVG to canvas via image
    const blob = new Blob([r.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const out = new Image();
    out.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const cx = c.getContext("2d");
      if (!cx) return;
      cx.clearRect(0, 0, c.width, c.height);
      cx.drawImage(out, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(b));
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    out.src = url;
    toast.success("Halftone applied");
  }, [image, cellSize, angle, intensity, minDot, maxDot, pattern, colorMode, invert, fgColor, bgColor, previewUrl]);

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

  const csv = useMemo(() => (result ? statsToCsv(result) : ""), [result]);

  const avgLuminance = useMemo(() => {
    if (!result || result.cells.length === 0) return 0;
    return result.cells.reduce((s, c) => s + c.luminance, 0) / result.cells.length;
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            {PRESETS.map((p) => (
              <Button key={p.name} variant="ghost" size="sm" onClick={() => applyPreset(p)}>{p.name}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Pattern</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PATTERNS.map((p) => (
                <Button key={p.value} size="sm" variant={pattern === p.value ? "default" : "outline"} onClick={() => setPattern(p.value)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Color mode</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {MODES.map((m) => (
                <Button key={m.value} size="sm" variant={colorMode === m.value ? "default" : "outline"} onClick={() => setColorMode(m.value)}>{m.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Cell size: {cellSize}px</Label>
              <input type="range" min={2} max={32} value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Angle: {angle}°</Label>
              <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {intensity.toFixed(2)}</Label>
              <input type="range" min={0.5} max={3} step={0.1} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Min dot: {minDot.toFixed(2)}</Label>
              <input type="range" min={0} max={0.5} step={0.05} value={minDot} onChange={(e) => setMinDot(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max dot: {maxDot.toFixed(2)}</Label>
              <input type="range" min={0.5} max={1} step={0.05} value={maxDot} onChange={(e) => setMaxDot(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <Label className="text-xs text-muted-foreground">Invert</Label>
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
            </div>
          </div>
          <div className="flex gap-3 text-xs items-center">
            <span>Dot color:</span>
            <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
            <span>Background:</span>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!image}>Apply halftone</Button>
            <Button variant="outline" size="sm" onClick={downloadPng} disabled={!previewUrl}>Download PNG</Button>
            <DownloadButton getText={() => svgText} filename={fileName.replace(/\.png$/, ".svg")} mime="image/svg+xml" label="Download SVG" disabled={!svgText} />
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="halftone-stats.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
            <Button size="sm" variant="ghost" onClick={() => { setCellSize(8); setAngle(45); setIntensity(1.2); setMinDot(0.1); setMaxDot(0.9); setPattern("round"); setColorMode("grayscale"); setInvert(false); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />

      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Halftone preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Stats</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Cells</p><p className="font-bold">{result.stats.totalCells}</p></div>
              <div><p className="text-xs text-muted-foreground">Grid</p><p className="font-bold">{result.cols}×{result.rows}</p></div>
              <div><p className="text-xs text-muted-foreground">LPI</p><p className="font-bold">{result.lpi.toFixed(1)}</p></div>
              <div><p className="text-xs text-muted-foreground">Ink coverage</p><p className="font-bold">{result.stats.inkCoverage.toFixed(1)}%</p></div>
              <div><p className="text-xs text-muted-foreground">Avg dot</p><p className="font-bold">{result.stats.avgDotSize.toFixed(3)}</p></div>
              <div><p className="text-xs text-muted-foreground">Min dot</p><p className="font-bold">{result.stats.minDotSize.toFixed(3)}</p></div>
              <div><p className="text-xs text-muted-foreground">Max dot</p><p className="font-bold">{result.stats.maxDotSize.toFixed(3)}</p></div>
              <div><p className="text-xs text-muted-foreground">Avg luminance</p><p className="font-bold">{avgLuminance.toFixed(3)}</p></div>
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> halftone rendering runs locally via Canvas. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}
