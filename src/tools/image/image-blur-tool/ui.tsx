"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { computeBlurParams, validateDimensions } from "./logic";
import { toast } from "sonner";

function boxBlurPass(data: Uint8ClampedArray, width: number, height: number, radius: number, axis: "x" | "y") {
  const tmp = new Uint8ClampedArray(data.length);
  const window = 2 * radius + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = axis === "x" ? Math.min(width - 1, Math.max(0, x + k)) : x;
        const sy = axis === "y" ? Math.min(height - 1, Math.max(0, y + k)) : y;
        const i = (sy * width + sx) * 4;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        a += data[i + 3]!;
      }
      const i = (y * width + x) * 4;
      tmp[i] = r / window;
      tmp[i + 1] = g / window;
      tmp[i + 2] = b / window;
      tmp[i + 3] = a / window;
    }
  }
  data.set(tmp);
}

export default function ImageBlurTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("blurred.png");
  const [radius, setRadius] = useState(5);
  const [passes, setPasses] = useState(3);
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.9);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-blurred.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const params = computeBlurParams({ radius, passes });
    if ("error" in params) {
      setError(params.error);
      return;
    }
    const dim = validateDimensions(image.naturalWidth, image.naturalHeight);
    if ("error" in dim) {
      setError(dim.error);
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
      if (params.radius > 0) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let p = 0; p < params.passes; p++) {
          boxBlurPass(data.data, canvas.width, canvas.height, params.radius, "x");
          boxBlurPass(data.data, canvas.width, canvas.height, params.radius, "y");
        }
        ctx.putImageData(data, 0, 0);
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setBusy(false);
        },
        format,
        format === "image/png" ? undefined : quality,
      );
    } catch {
      setError("Blur failed — image may be too large");
      setBusy(false);
    }
  }, [image, radius, passes, format, quality, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Radius: {radius}px</Label>
              <input
                type="range"
                min={0}
                max={30}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Passes: {passes}</Label>
              <input
                type="range"
                min={1}
                max={5}
                value={passes}
                onChange={(e) => setPasses(Number(e.target.value))}
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
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Blurring…" : "Apply blur"}</Button>
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
            <img src={previewUrl} alt="Blurred preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> blur runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
