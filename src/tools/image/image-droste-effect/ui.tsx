"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { mapDrostePixel, validateDrosteOptions } from "./logic";
import { toast } from "sonner";

export default function ImageDrosteEffect() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("droste.png");
  const [levels, setLevels] = useState(4);
  const [twist, setTwist] = useState(0.3);
  const [innerRadius, setInnerRadius] = useState(0.5);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-droste.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateDrosteOptions({ levels, twist, innerRadius });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dst = ctx.createImageData(canvas.width, canvas.height);
    const s = src.data, d = dst.data, w = canvas.width, h = canvas.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = mapDrostePixel(x, y, w, h, { levels, twist, innerRadius });
        const sx = Math.max(0, Math.min(w - 1, Math.round(m.x)));
        const sy = Math.max(0, Math.min(h - 1, Math.round(m.y)));
        const si = (sy * w + sx) * 4;
        const di = (y * w + x) * 4;
        d[di] = s[si]!; d[di + 1] = s[si + 1]!; d[di + 2] = s[si + 2]!; d[di + 3] = s[si + 3]!;
      }
    }
    ctx.putImageData(dst, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, levels, twist, innerRadius, previewUrl]);

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
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Levels: {levels}</Label>
            <input type="range" min={1} max={8} step={1} value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Twist: {twist.toFixed(2)}</Label>
            <input type="range" min={-3.14} max={3.14} step={0.05} value={twist} onChange={(e) => setTwist(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Inner radius: {innerRadius.toFixed(2)}</Label>
            <input type="range" min={0.1} max={0.9} step={0.05} value={innerRadius} onChange={(e) => setInnerRadius(Number(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Apply Droste</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {previewUrl && <CopyButton getText={() => previewUrl} label="Copy URL" />}
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Droste preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> Droste effect runs locally via Canvas API.</p>
      </CardContent></Card>
    </div>
  );
}
