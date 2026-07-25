"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateDuotone, duotonePixel } from "./logic";
import { toast } from "sonner";

export default function ImageDuotoneMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("duotone.png");
  const [shadow, setShadow] = useState("#1a0d4d");
  const [highlight, setHighlight] = useState("#f4c060");
  const [contrast, setContrast] = useState(1.2);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hexToRgb = (hex: string): [number, number, number] => {
    const m = hex.replace("#", "");
    return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  };

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-duotone.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateDuotone({ shadow: hexToRgb(shadow), highlight: hexToRgb(highlight), contrast });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = src.data;
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = duotonePixel(px[i]!, px[i + 1]!, px[i + 2]!, v);
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
    ctx.putImageData(src, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, shadow, highlight, contrast, previewUrl]);

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
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Shadow</Label>
                <input type="color" value={shadow} onChange={(e) => setShadow(e.target.value)} className="h-8 w-12 rounded border" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Highlight</Label>
                <input type="color" value={highlight} onChange={(e) => setHighlight(e.target.value)} className="h-8 w-12 rounded border" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contrast: {contrast.toFixed(2)}</Label>
              <input type="range" min={50} max={200} value={Math.round(contrast * 100)} onChange={(e) => setContrast(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Apply duotone</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime="image/png" />
            </div>
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Duotone preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> duotone runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
