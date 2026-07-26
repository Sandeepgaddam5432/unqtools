"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generateTiling,
  cssBackgroundSnippet,
  svgPatternSnippet,
  statsToCsv,
  type RepeatLayout,
  type TileResult,
} from "./logic";
import { toast } from "sonner";

const LAYOUTS: { value: RepeatLayout; label: string; desc: string }[] = [
  { value: "grid", label: "Grid", desc: "Simple repeating grid" },
  { value: "half-drop", label: "Half-drop", desc: "Staggered by half tile" },
  { value: "brick", label: "Brick", desc: "Brick pattern offset" },
  { value: "mirror", label: "Mirror", desc: "Alternating mirror" },
];

export default function ImageTilingPattern() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [tileW, setTileW] = useState(128);
  const [tileH, setTileH] = useState(128);
  const [layout, setLayout] = useState<RepeatLayout>("grid");
  const [outputW, setOutputW] = useState(512);
  const [outputH, setOutputH] = useState(512);
  const [spacing, setSpacing] = useState(0);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [feather, setFeather] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TileResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setTileW(img.naturalWidth);
      setTileH(img.naturalHeight);
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
    const r = generateTiling({
      tileWidth: tileW, tileHeight: tileH,
      layout, outputWidth: outputW, outputHeight: outputH,
      spacing, bgColor, feather,
    });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    const canvas = canvasRef.current;
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, outputW, outputH);
    for (const p of r.positions) {
      ctx.save();
      const cx = p.x + tileW / 2;
      const cy = p.y + tileH / 2;
      ctx.translate(cx, cy);
      if (p.mirrorH) ctx.scale(-1, 1);
      if (p.mirrorV) ctx.scale(1, -1);
      ctx.drawImage(image, -tileW / 2, -tileH / 2, tileW, tileH);
      ctx.restore();
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
    toast.success("Tiling applied");
  }, [image, tileW, tileH, layout, outputW, outputH, spacing, bgColor, feather, previewUrl]);

  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "tiling.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Downloaded");
    }, "image/png");
  }, []);

  const css = useMemo(() => cssBackgroundSnippet({ tileWidth: tileW, tileHeight: tileH, layout, outputWidth: outputW, outputHeight: outputH, spacing, bgColor, feather }), [tileW, tileH, layout, outputW, outputH, spacing, bgColor, feather]);
  const svg = useMemo(() => svgPatternSnippet({ tileWidth: tileW, tileHeight: tileH, layout, outputWidth: outputW, outputHeight: outputH, spacing, bgColor, feather }), [tileW, tileH, layout, outputW, outputH, spacing, bgColor, feather]);
  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose tile image</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Layout</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {LAYOUTS.map((l) => (
                <Button key={l.value} size="sm" variant={layout === l.value ? "default" : "outline"} onClick={() => setLayout(l.value)} title={l.desc}>{l.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tile width: {tileW}px</Label>
              <input type="range" min={16} max={512} value={tileW} onChange={(e) => setTileW(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tile height: {tileH}px</Label>
              <input type="range" min={16} max={512} value={tileH} onChange={(e) => setTileH(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output width: {outputW}px</Label>
              <input type="range" min={128} max={2048} step={32} value={outputW} onChange={(e) => setOutputW(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output height: {outputH}px</Label>
              <input type="range" min={128} max={2048} step={32} value={outputH} onChange={(e) => setOutputH(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Spacing: {spacing}px</Label>
              <input type="range" min={0} max={64} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Feather: {feather}px</Label>
              <input type="range" min={0} max={32} value={feather} onChange={(e) => setFeather(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div className="flex gap-3 text-xs items-center">
            <span>Background:</span>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!image}>Generate tiling</Button>
            <Button variant="outline" size="sm" onClick={downloadPng} disabled={!previewUrl}>Download PNG</Button>
            <CopyButton getText={() => css} label="Copy CSS" />
            <DownloadButton getText={() => svg} filename="tiling-pattern.svg" mime="image/svg+xml" label="Download SVG" />
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="tiling-stats.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Tiling preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Stats</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Tiles per row</p><p className="font-bold">{result.stats.tilesPerRow}</p></div>
              <div><p className="text-xs text-muted-foreground">Tiles per col</p><p className="font-bold">{result.stats.tilesPerCol}</p></div>
              <div><p className="text-xs text-muted-foreground">Total tiles</p><p className="font-bold">{result.stats.totalTiles.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Render time</p><p className="font-bold">{result.stats.durationMs.toFixed(1)}ms</p></div>
            </div>
            {result.warnings.length > 0 && <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> tiling runs locally via Canvas. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}
