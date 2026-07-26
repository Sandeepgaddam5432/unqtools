"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeGrid,
  statsToCsv,
  previewSnippet,
  type GridMode,
  type GridResult,
} from "./logic";
import { toast } from "sonner";

const MODES: { value: GridMode; label: string; posts: number }[] = [
  { value: "3x1", label: "3×1 (3 posts)", posts: 3 },
  { value: "3x3", label: "3×3 (9 posts)", posts: 9 },
  { value: "3x9", label: "3×9 (27 posts)", posts: 27 },
];

export default function ImageInstagramGrid() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("tile.png");
  const [mode, setMode] = useState<GridMode>("3x3");
  const [gap, setGap] = useState(0);
  const [baseName, setBaseName] = useState("ig-tile");
  const [tileUrls, setTileUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GridResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-grid.png");
      setError(null);
      setTileUrls([]);
      setResult(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    setError(null);
    const r = computeGrid({ width: image.naturalWidth, height: image.naturalHeight, mode, gap, baseName });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    // Slice image into tiles via canvas
    const tileBlobUrls: string[] = [];
    let pending = r.tiles.length;
    const tmpCanvas = document.createElement("canvas");
    r.tiles.forEach((t) => {
      tmpCanvas.width = t.width;
      tmpCanvas.height = t.height;
      const ctx = tmpCanvas.getContext("2d");
      if (!ctx) { pending--; return; }
      ctx.drawImage(image, t.x, t.y, t.width, t.height, 0, 0, t.width, t.height);
      tmpCanvas.toBlob((blob) => {
        if (blob) tileBlobUrls[t.index] = URL.createObjectURL(blob);
        pending--;
        if (pending === 0) {
          setTileUrls([...tileBlobUrls]);
          toast.success(`Generated ${r.tiles.length} tiles`);
        }
      }, "image/png");
    });
  }, [image, mode, gap, baseName]);

  const downloadTile = useCallback((tile: { fileName: string }, url: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = tile.fileName; a.click();
    toast.success(`Downloaded ${tile.fileName}`);
  }, []);

  const downloadAllManifest = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.csvManifest], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${baseName}-manifest.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Manifest downloaded");
  }, [result, baseName]);

  const preview = useMemo(() => (mode ? previewSnippet(mode, 100, 100) : ""), [mode]);
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
          <div>
            <Label className="text-xs text-muted-foreground">Grid mode</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {MODES.map((m) => (
                <Button key={m.value} size="sm" variant={mode === m.value ? "default" : "outline"} onClick={() => setMode(m.value)}>{m.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Base file name</Label>
              <input type="text" value={baseName} onChange={(e) => setBaseName(e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preview gap: {gap}px (preview only)</Label>
              <input type="range" min={0} max={32} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!image}>Split into grid</Button>
            <Button variant="outline" size="sm" onClick={downloadAllManifest} disabled={!result}>Download manifest CSV</Button>
            <CopyButton getText={() => csv} label="Copy stats CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename={`${baseName}-stats.csv`} mime="text/csv" label="Download stats" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />

      {image && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Source preview ({image.naturalWidth}×{image.naturalHeight}px)</p>
            <img src={image.src} alt="Source" className="max-w-full max-h-64 rounded-md border" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Generated tiles ({result.tiles.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-2">
              {result.tiles.map((t, i) => (
                <div key={t.index} className="border rounded-md p-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">#{t.postOrder} · {t.fileName}</span>
                  {tileUrls[i] ? (
                    <img src={tileUrls[i]} alt={t.fileName} className="w-full rounded" />
                  ) : (
                    <div className="w-full aspect-square bg-muted rounded animate-pulse" />
                  )}
                  {tileUrls[i] && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => downloadTile(t, tileUrls[i]!)}>Download</Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Stats</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Source</p><p className="font-bold">{result.stats.sourceWidth}×{result.stats.sourceHeight}px</p></div>
              <div><p className="text-xs text-muted-foreground">Grid</p><p className="font-bold">{result.stats.cols}×{result.stats.rows}</p></div>
              <div><p className="text-xs text-muted-foreground">Tiles</p><p className="font-bold">{result.stats.totalTiles}</p></div>
              <div><p className="text-xs text-muted-foreground">Tile size</p><p className="font-bold">{result.stats.tileWidth}×{result.stats.tileHeight}px</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <pre className="text-xs bg-muted p-2 rounded-md whitespace-pre font-mono">{preview}</pre>
              <div className="col-span-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Posting order</p>
                <p>Post tiles in order 1, 2, 3, … from top-left to bottom-right. Instagram will arrange them in the grid automatically.</p>
                {result.warnings.length > 0 && <p className="mt-2 text-amber-600">{result.warnings.join(" ")}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all splitting runs locally via Canvas. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}
