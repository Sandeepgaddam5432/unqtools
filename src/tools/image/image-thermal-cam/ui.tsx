"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateThermal, thermalPixel } from "./logic";
import { toast } from "sonner";

export default function ImageThermalCam() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("thermal.png");
  const [contrast, setContrast] = useState(1.2);
  const [invert, setInvert] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-thermal.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateThermal({ contrast, invert });
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
      const [r, g, b] = thermalPixel(px[i]!, px[i + 1]!, px[i + 2]!, v);
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
    ctx.putImageData(src, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, contrast, invert, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Contrast: {contrast.toFixed(2)}</Label>
              <input type="range" min={50} max={200} value={Math.round(contrast * 100)} onChange={(e) => setContrast(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
              Invert palette (cold = bright)
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Apply thermal</Button>
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
          <img src={previewUrl} alt="Thermal preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> thermal mapping runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
