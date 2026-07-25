"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { oldPhotoPixel, makeRng, validateOldPhotoOptions } from "./logic";
import { toast } from "sonner";

export default function ImageOldPhoto() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("old-photo.png");
  const [sepia, setSepia] = useState(0.8);
  const [vignette, setVignette] = useState(0.5);
  const [grain, setGrain] = useState(0.3);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-old.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const opts = { sepia, vignette, grain, vignetteRadius: 0.5 };
    const v = validateOldPhotoOptions(opts);
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
    const w = canvas.width, h = canvas.height;
    const rng = makeRng(Date.now() & 0xffffffff);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const n = rng() * 2 - 1;
        const out = oldPhotoPixel({ r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! }, x, y, w, h, n, opts);
        px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b;
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, sepia, vignette, grain, previewUrl]);

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
            <div><Label className="text-xs text-muted-foreground">Sepia: {Math.round(sepia * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(sepia * 100)} onChange={(e) => setSepia(Number(e.target.value) / 100)} className="w-full" /></div>
            <div><Label className="text-xs text-muted-foreground">Vignette: {Math.round(vignette * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(vignette * 100)} onChange={(e) => setVignette(Number(e.target.value) / 100)} className="w-full" /></div>
            <div><Label className="text-xs text-muted-foreground">Grain: {Math.round(grain * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(grain * 100)} onChange={(e) => setGrain(Number(e.target.value) / 100)} className="w-full" /></div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={apply}>Apply old photo</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => ""} filename={fileName} mime="image/png" label="Download (shared)" disabled={!previewUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Old photo preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> vintage rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
