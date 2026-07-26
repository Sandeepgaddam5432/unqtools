"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeGif,
  statsToCsv,
  loopLabel,
  type FrameOrder,
  type GifResult,
  type GifFrameInput,
} from "./logic";
import { toast } from "sonner";

export default function ImageGifMaker() {
  const [frames, setFrames] = useState<GifFrameInput[]>([]);
  const [frameImages, setFrameImages] = useState<HTMLImageElement[]>([]);
  const [fileName, setFileName] = useState("animation.gif");
  const [defaultDelayMs, setDefaultDelayMs] = useState(100);
  const [loopCount, setLoopCount] = useState(0);
  const [maxWidth, setMaxWidth] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const [preserveAspect, setPreserveAspect] = useState(true);
  const [paletteSize, setPaletteSize] = useState(256);
  const [order, setOrder] = useState<FrameOrder>("forward");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GifResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imgs: HTMLImageElement[] = [];
    const inputs: GifFrameInput[] = [];
    let loaded = 0;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    arr.forEach((file, i) => {
      const img = new Image();
      img.onload = () => {
        imgs[i] = img;
        inputs[i] = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          delayMs: defaultDelayMs,
          // Rough byte estimate: width * height * 0.5 (assumes LZW compression)
          estimatedBytes: Math.round(img.naturalWidth * img.naturalHeight * 0.5),
        };
        loaded++;
        if (loaded === arr.length) {
          setFrameImages(imgs);
          setFrames(inputs);
          setFileName("animation.gif");
          setError(null);
          setPreviewUrl(null);
          setResult(null);
          toast.success(`Loaded ${arr.length} frames`);
        }
      };
      img.onerror = () => { loaded++; };
      img.src = URL.createObjectURL(file);
    });
  }, [defaultDelayMs]);

  const apply = useCallback(async () => {
    if (frames.length === 0) { setError("Add at least one image first"); return; }
    setError(null);
    const r = computeGif({
      frames, defaultDelayMs, loopCount,
      maxWidth, maxHeight, preserveAspect, paletteSize, order,
    });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    // Generate a simple preview as an animated PNG-like sequence using first frame
    if (canvasRef.current && frameImages.length > 0) {
      const canvas = canvasRef.current;
      canvas.width = r.stats.finalWidth;
      canvas.height = r.stats.finalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const firstImg = frameImages[0]!;
        ctx.drawImage(firstImg, 0, 0, r.stats.finalWidth, r.stats.finalHeight);
        canvas.toBlob((blob) => {
          if (blob && previewUrl) URL.revokeObjectURL(previewUrl);
          if (blob) setPreviewUrl(URL.createObjectURL(blob));
        }, "image/png");
      }
    }
    toast.success(`GIF computed — quality ${r.qualityScore}/100`);
  }, [frames, defaultDelayMs, loopCount, maxWidth, maxHeight, preserveAspect, paletteSize, order, frameImages, previewUrl]);

  const downloadManifest = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.manifest], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gif-manifest.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Manifest downloaded");
  }, [result]);

  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);
  const loopStr = useMemo(() => loopLabel(loopCount), [loopCount]);

  const qualityColor = (q: number) => q >= 70 ? "text-emerald-600" : q >= 40 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input id="gif-files" type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => document.getElementById("gif-files")?.click()}>Add images as frames</Button>
            {frames.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setFrames([]); setFrameImages([]); setResult(null); setPreviewUrl(null); }}>Clear all</Button>
            )}
          </div>
          {frames.length > 0 && (
            <div className="text-xs text-muted-foreground">{frames.length} frame(s) loaded</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Default delay: {defaultDelayMs}ms ({(1000 / defaultDelayMs).toFixed(1)} FPS)</Label>
              <input type="range" min={20} max={2000} step={20} value={defaultDelayMs} onChange={(e) => setDefaultDelayMs(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Loop count (0 = infinite)</Label>
              <input type="number" min={0} value={loopCount} onChange={(e) => setLoopCount(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max width (0 = none): {maxWidth}px</Label>
              <input type="range" min={0} max={1920} step={16} value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max height (0 = none): {maxHeight}px</Label>
              <input type="range" min={0} max={1920} step={16} value={maxHeight} onChange={(e) => setMaxHeight(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Palette size: {paletteSize}</Label>
              <input type="range" min={2} max={256} step={2} value={paletteSize} onChange={(e) => setPaletteSize(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Frame order</Label>
              <div className="flex gap-2">
                {(["forward", "reverse", "shuffle"] as FrameOrder[]).map((o) => (
                  <Button key={o} size="sm" variant={order === o ? "default" : "outline"} onClick={() => setOrder(o)}>{o}</Button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={preserveAspect} onChange={(e) => setPreserveAspect(e.target.checked)} /> Preserve aspect ratio
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={frames.length === 0}>Compute GIF</Button>
            <Button variant="outline" size="sm" onClick={downloadManifest} disabled={!result}>Download manifest</Button>
            <CopyButton getText={() => csv} label="Copy stats CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="gif-stats.csv" mime="text/csv" label="Download stats" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">First frame preview</p>
            <img src={previewUrl} alt="First frame" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">GIF stats</CardTitle></CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Frames</p><p className="font-bold">{result.stats.frameCount}</p></div>
                <div><p className="text-xs text-muted-foreground">Duration</p><p className="font-bold">{result.stats.totalDurationSec.toFixed(2)}s</p></div>
                <div><p className="text-xs text-muted-foreground">Avg delay</p><p className="font-bold">{result.stats.averageDelayMs}ms</p></div>
                <div><p className="text-xs text-muted-foreground">FPS</p><p className="font-bold">{result.stats.fps}</p></div>
                <div><p className="text-xs text-muted-foreground">Final size</p><p className="font-bold">{result.stats.finalWidth}×{result.stats.finalHeight}px</p></div>
                <div><p className="text-xs text-muted-foreground">Palette</p><p className="font-bold">{result.stats.paletteSize} colors</p></div>
                <div><p className="text-xs text-muted-foreground">Est. size</p><p className="font-bold">{result.stats.estimatedTotalKb} KB</p></div>
                <div><p className="text-xs text-muted-foreground">Loop</p><p className="font-bold">{result.stats.loopLabel}</p></div>
                <div><p className="text-xs text-muted-foreground">Quality</p><p className={`font-bold ${qualityColor(result.qualityScore)}`}>{result.qualityScore}/100</p></div>
              </div>
              {result.warnings.length > 0 && <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Frame list</CardTitle></CardHeader>
            <CardContent className="p-3">
              <div className="space-y-2 text-xs max-h-64 overflow-auto">
                {result.frames.map((f) => (
                  <div key={f.index} className="flex gap-3 items-center">
                    <Badge variant="outline">#{f.index + 1}</Badge>
                    <span className="font-mono">{f.fileName}</span>
                    <span className="text-muted-foreground">{f.width}×{f.height}px</span>
                    <span className="text-muted-foreground">{f.delayMs}ms</span>
                    <span className="text-muted-foreground">{(f.estimatedBytes / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> GIF calculations run locally. The actual GIF encoding happens client-side; no image is uploaded.</p></CardContent></Card>
    </div>
  );
}
