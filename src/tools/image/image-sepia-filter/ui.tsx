"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { validateSepiaOptions, SEPIA_MATRIX } from "./logic";
import { toast } from "sonner";

export default function ImageSepiaFilter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("sepia.png");
  const [strength, setStrength] = useState(1);
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-sepia.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateSepiaOptions({ strength });
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const s = strength;
    const m = SEPIA_MATRIX;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!;
      const g = px[i + 1]!;
      const b = px[i + 2]!;
      const sr = m.rr * r + m.rg * g + m.rb * b;
      const sg = m.gr * r + m.gg * g + m.gb * b;
      const sb = m.br * r + m.bg * g + m.bb * b;
      px[i] = Math.max(0, Math.min(255, Math.round(r + (sr - r) * s)));
      px[i + 1] = Math.max(0, Math.min(255, Math.round(g + (sg - g) * s)));
      px[i + 2] = Math.max(0, Math.min(255, Math.round(b + (sb - b) * s)));
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, strength, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Image downloaded");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [fileName, format, quality]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Choose image
          </Button>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Strength: {Math.round(strength * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(strength * 100)}
                onChange={(e) => setStrength(Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            {format !== "image/png" && (
              <div>
                <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(Number(e.target.value) / 100)}
                  className="w-32"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Apply sepia</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Sepia preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> sepia conversion runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
