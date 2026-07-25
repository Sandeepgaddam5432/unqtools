"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateFlare, falloff, blendFlare, ghostPositions } from "./logic";
import { toast } from "sonner";

export default function ImageLensFlare() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("lens-flare.png");
  const [fx, setFx] = useState(0.3);
  const [fy, setFy] = useState(0.3);
  const [intensity, setIntensity] = useState(0.8);
  const [color, setColor] = useState("#ffd27f");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-flare.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const hexToRgb = (hex: string): [number, number, number] => {
    const m = hex.replace("#", "");
    return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  };

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateFlare({ fx, fy, intensity, color: hexToRgb(color) });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = imgData.data;
    const cx = v.fx * canvas.width, cy = v.fy * canvas.height;
    const radius = Math.max(canvas.width, canvas.height) * 0.35;
    const ghosts = ghostPositions(v.fx, v.fy, 5);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const dist = Math.hypot(x - cx, y - cy);
        const amt = falloff(dist, radius) * v.intensity;
        let blended: [number, number, number, number] = [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
        if (amt > 0.01) blended = blendFlare(blended, v.color, amt);
        for (const g of ghosts) {
          const gx = g.x * canvas.width, gy = g.y * canvas.height;
          const gd = Math.hypot(x - gx, y - gy);
          const ga = falloff(gd, radius * 0.12 * g.scale) * v.intensity * 0.4;
          if (ga > 0.01) blended = blendFlare(blended, v.color, ga);
        }
        px[i] = blended[0]; px[i + 1] = blended[1]; px[i + 2] = blended[2];
      }
    }
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, fx, fy, intensity, color, previewUrl]);

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

  const dataUrl = previewUrl ? previewUrl : "";

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
              <Label className="text-xs text-muted-foreground">Flare X: {Math.round(fx * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(fx * 100)} onChange={(e) => setFx(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Flare Y: {Math.round(fy * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(fy * 100)} onChange={(e) => setFy(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {Math.round(intensity * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Apply flare</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={() => dataUrl} filename={fileName} disabled={!previewUrl} mime="image/png" label="Save blob" />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Lens flare preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> lens flare runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
