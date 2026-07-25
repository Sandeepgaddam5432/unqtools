"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateSketch, toGray, boxBlurGray, dodgeBlend } from "./logic";
import { toast } from "sonner";

export default function ImagePencilSketch() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("pencil-sketch.png");
  const [intensity, setIntensity] = useState(0.7);
  const [radius, setRadius] = useState(5);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-sketch.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateSketch({ intensity, radius });
    if ("error" in v) { setError(v.error); return; }
    setError(null); setBusy(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = src.data;
      const w = canvas.width, h = canvas.height;
      const gray = toGray(px, w, h);
      const blurred = boxBlurGray(gray, w, h, v.radius);
      for (let p = 0; p < gray.length; p++) {
        const v2 = dodgeBlend(gray[p]!, blurred[p]!, v.intensity);
        const i = p * 4;
        px[i] = v2; px[i + 1] = v2; px[i + 2] = v2;
      }
      ctx.putImageData(src, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setBusy(false);
      }, "image/png");
    } catch {
      setError("Sketch failed — image may be too large");
      setBusy(false);
    }
  }, [image, intensity, radius, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Stroke intensity: {Math.round(intensity * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Blur radius: {radius}px</Label>
              <input type="range" min={1} max={20} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Sketching…" : "Apply sketch"}</Button>
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
          <img src={previewUrl} alt="Pencil sketch preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> pencil sketch runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
