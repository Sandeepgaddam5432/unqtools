"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import {
  segmentAngle,
  toPolar,
  toCartesian,
  mirrorToWedge,
  validateSegments,
  KALEIDOSCOPE_PRESETS,
} from "./logic";
import { toast } from "sonner";

export default function ImageKaleidoscope() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [segments, setSegments] = useState(8);
  const [rotation, setRotation] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const segValid = useMemo(() => validateSegments(segments), [segments]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    if (typeof segValid !== "number") {
      setError(segValid.error);
      return;
    }
    setError(null);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = canvasRef.current;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const angle = segmentAngle(segValid);
    const rot = (rotation * Math.PI) / 180;

    // Off-screen source canvas for sampling.
    const src = document.createElement("canvas");
    src.width = size;
    src.height = size;
    const sctx = src.getContext("2d");
    if (!sctx) return;
    const sx = (image.naturalWidth - size) / 2;
    const sy = (image.naturalHeight - size) / 2;
    sctx.drawImage(image, sx, sy, size, size, 0, 0, size, size);
    const srcData = sctx.getImageData(0, 0, size, size);

    const out = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = toPolar(x, y, cx, cy);
        const m = mirrorToWedge(p.theta, segValid, rot);
        const src = toCartesian(p.r, m.theta, cx, cy);
        const sx2 = Math.round(src.x);
        const sy2 = Math.round(src.y);
        if (sx2 >= 0 && sx2 < size && sy2 >= 0 && sy2 < size) {
          const si = (sy2 * size + sx2) * 4;
          const di = (y * size + x) * 4;
          out.data[di] = srcData.data[si];
          out.data[di + 1] = srcData.data[si + 1];
          out.data[di + 2] = srcData.data[si + 2];
          out.data[di + 3] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Kaleidoscope generated");
    }, "image/png");
  }, [image, segValid, rotation, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kaleidoscope.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }, []);

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
          <div className="flex flex-wrap gap-2">
            {KALEIDOSCOPE_PRESETS.map((n) => (
              <Button
                key={n}
                variant={segments === n ? "default" : "outline"}
                size="sm"
                onClick={() => setSegments(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Segments (2-16): {segments}
              </Label>
              <Input
                type="number"
                min={2}
                max={16}
                value={segments}
                onChange={(e) => setSegments(Number(e.target.value) || 2)}
                className="w-24"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Rotation: {rotation}°
              </Label>
              <Input
                type="range"
                min={0}
                max={360}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={apply} disabled={!image}>
              Generate
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <img
              src={previewUrl}
              alt="Kaleidoscope preview"
              className="max-w-full rounded-md border"
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all processing runs
            locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
