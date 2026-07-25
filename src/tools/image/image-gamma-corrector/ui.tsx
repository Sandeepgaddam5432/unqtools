"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { buildGammaLut, validateGammaOptions } from "./logic";
import { toast } from "sonner";

export default function ImageGammaCorrector() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("gamma.png");
  const [gamma, setGamma] = useState(2.2);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-gamma.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateGammaOptions({ gamma });
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
    const lut = buildGammaLut(gamma);
    for (let i = 0; i < px.length; i += 4) {
      px[i] = lut[px[i]!]!;
      px[i + 1] = lut[px[i + 1]!]!;
      px[i + 2] = lut[px[i + 2]!]!;
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, gamma, previewUrl]);

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
            <Label className="text-xs text-muted-foreground">Gamma: {gamma.toFixed(2)}</Label>
            <input type="range" min={0.1} max={3} step={0.05} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Apply gamma</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {previewUrl && <CopyButton getText={() => previewUrl} label="Copy URL" />}
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Gamma preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> gamma correction runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
