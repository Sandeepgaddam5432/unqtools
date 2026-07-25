"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { buildHistogram, clipHistogram, buildCdf, equalizeLuma, toLuma, applyLuma, validateClaheOptions } from "./logic";
import { toast } from "sonner";

export default function ImageClaheTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("clahe.png");
  const [clipLimit, setClipLimit] = useState(30);
  const [tileSize, setTileSize] = useState(32);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-clahe.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateClaheOptions({ clipLimit, tileSize });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const w = canvas.width;
    const h = canvas.height;
    // Process tile-by-tile.
    for (let ty = 0; ty < h; ty += tileSize) {
      for (let tx = 0; tx < w; tx += tileSize) {
        const tw = Math.min(tileSize, w - tx);
        const th = Math.min(tileSize, h - ty);
        const luma: number[] = [];
        const idxs: number[] = [];
        for (let y = 0; y < th; y++) {
          for (let x = 0; x < tw; x++) {
            const i = ((ty + y) * w + (tx + x)) * 4;
            luma.push(toLuma({ r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! }));
            idxs.push(i);
          }
        }
        const hist = clipHistogram(buildHistogram(luma), clipLimit);
        const cdf = buildCdf(hist);
        const total = luma.length;
        for (let k = 0; k < idxs.length; k++) {
          const i = idxs[k]!;
          const newLuma = equalizeLuma(luma[k]!, cdf, total);
          const out = applyLuma({ r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! }, newLuma);
          px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b;
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, clipLimit, tileSize, previewUrl]);

  const getBlobUrl = useCallback(async () => {
    if (!canvasRef.current) return "";
    return new Promise<string>((resolve) => {
      canvasRef.current!.toBlob((blob) => {
        if (!blob) return resolve("");
        resolve(URL.createObjectURL(blob));
      }, "image/png");
    });
  }, []);

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
              <Label className="text-xs text-muted-foreground">Clip limit: {clipLimit}</Label>
              <input type="range" min={1} max={100} value={clipLimit} onChange={(e) => setClipLimit(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tile size: {tileSize}px</Label>
              <input type="range" min={8} max={128} step={8} value={tileSize} onChange={(e) => setTileSize(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={apply}>Apply CLAHE</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => { const u = await getBlobUrl(); return u; }} filename={fileName} mime="image/png" label="Download (shared)" disabled={!previewUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="CLAHE preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> CLAHE runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
