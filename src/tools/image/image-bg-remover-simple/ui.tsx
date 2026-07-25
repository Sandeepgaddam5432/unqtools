"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import {
  averageColor,
  isBackground,
  validateBgRemoveOptions,
  validateImageBounds,
  type Rgb,
} from "./logic";
import { toast } from "sonner";

export default function ImageBgRemoverSimple() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("no-bg.png");
  const [threshold, setThreshold] = useState(30);
  const [sampleSize, setSampleSize] = useState(4);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-no-bg.png");
      setError(null);
      setPreviewUrl(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateBgRemoveOptions({ threshold, sampleSize });
    if ("error" in v) {
      setError(v.error);
      return;
    }
    const b = validateImageBounds(image.naturalWidth, image.naturalHeight);
    if ("error" in b) {
      setError(b.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
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
      // Sample 4 corners.
      const corners: Rgb[] = [
        averageColor(px, w, 0, 0, sampleSize),
        averageColor(px, w, w - sampleSize, 0, sampleSize),
        averageColor(px, w, 0, h - sampleSize, sampleSize),
        averageColor(px, w, w - sampleSize, h - sampleSize, sampleSize),
      ];
      // Average of corners is our bg color.
      const bg: Rgb = {
        r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
        g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
        b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
      };
      for (let i = 0; i < px.length; i += 4) {
        const pixel = { r: px[i]!, g: px[i + 1]!, b: px[i + 2]! };
        if (isBackground(pixel, bg, threshold)) {
          px[i + 3] = 0;
        }
      }
      ctx.putImageData(data, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setBusy(false);
        },
        "image/png",
      );
    } catch {
      setError("Background removal failed — image may be too large");
      setBusy(false);
    }
  }, [image, threshold, sampleSize, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [fileName]);

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
          <p className="text-xs text-muted-foreground">
            Best for images with a solid background color (e.g. product photos on plain backdrop).
          </p>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Color threshold: {threshold}</Label>
              <input
                type="range"
                min={0}
                max={200}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Corner sample size: {sampleSize}px</Label>
              <input
                type="range"
                min={1}
                max={20}
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>
                {busy ? "Removing…" : "Remove background"}
              </Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview (checkerboard = transparency)</p>
            <div
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              }}
            >
              <img src={previewUrl} alt="Background removed preview" className="max-w-full" />
            </div>
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> background removal runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
