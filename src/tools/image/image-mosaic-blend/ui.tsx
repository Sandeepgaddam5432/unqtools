"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import {
  alphaBlend,
  fadeBlend,
  fadeWeights,
  validateSameSize,
  type MosaicPixel,
} from "./logic";
import { toast } from "sonner";

export default function ImageMosaicBlend() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [fadeAmount, setFadeAmount] = useState(0.5);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sizes = useMemo(
    () => images.map((i) => ({ width: i.naturalWidth, height: i.naturalHeight })),
    [images],
  );
  const dim = useMemo(() => validateSameSize(sizes), [sizes]);
  const weights = useMemo(() => fadeWeights(Math.max(2, images.length)), [images.length]);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded: HTMLImageElement[] = [];
    let pending = files.length;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        pending--;
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loaded.push(img);
        pending--;
        if (pending === 0) {
          setImages((prev) => [...prev, ...loaded]);
          setError(null);
        }
      };
      img.onerror = () => {
        pending--;
      };
      img.src = url;
    });
  }, []);

  const blend = useCallback(() => {
    if (images.length === 0 || !canvasRef.current) return;
    if ("error" in dim) {
      setError(dim.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = dim.width;
    canvas.height = dim.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pull pixel data from each image.
    const pixels: Uint8ClampedArray[] = [];
    for (const img of images) {
      const off = document.createElement("canvas");
      off.width = dim.width;
      off.height = dim.height;
      const octx = off.getContext("2d");
      if (!octx) continue;
      octx.drawImage(img, 0, 0, dim.width, dim.height);
      pixels.push(octx.getImageData(0, 0, dim.width, dim.height).data);
    }
    if (pixels.length === 0) return;

    const out = ctx.createImageData(dim.width, dim.height);
    const total = pixels.length;
    const w = fadeWeights(Math.max(2, total));
    const fadeMix = fadeAmount; // 0 = pure average, 1 = cosine fade

    for (let i = 0; i < out.data.length; i += 4) {
      let acc: MosaicPixel = { r: 0, g: 0, b: 0, a: 0 };
      let avg: MosaicPixel = { r: 0, g: 0, b: 0, a: 0 };
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < pixels.length; k++) {
        const px: MosaicPixel = {
          r: pixels[k][i],
          g: pixels[k][i + 1],
          b: pixels[k][i + 2],
          a: pixels[k][i + 3],
        };
        acc = k === 0 ? px : alphaBlend(acc, px);
        r += px.r;
        g += px.g;
        b += px.b;
        a += px.a;
      }
      avg = { r: Math.round(r / total), g: Math.round(g / total), b: Math.round(b / total), a: Math.round(a / total) };
      const final = fadeBlend(avg, acc, fadeMix);
      out.data[i] = final.r;
      out.data[i + 1] = final.g;
      out.data[i + 2] = final.b;
      out.data[i + 3] = final.a;
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Mosaic blend complete");
    }, "image/png");
  }, [images, dim, fadeAmount, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mosaic-blend.png";
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
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Add images
            </Button>
            <div>
              <Label className="text-xs text-muted-foreground">
                Fade mix: {Math.round(fadeAmount * 100)}%
              </Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={Math.round(fadeAmount * 100)}
                onChange={(e) => setFadeAmount(Number(e.target.value) / 100)}
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={blend} disabled={images.length === 0}>
              Blend ({images.length})
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setImages([]);
                setPreviewUrl(null);
              }}
              disabled={images.length === 0}
            >
              Clear
            </Button>
          </div>
          {!("error" in dim) && images.length > 0 && (
            <Badge variant="secondary">
              {dim.width}×{dim.height}px · {images.length} images
            </Badge>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <img src={previewUrl} alt="Mosaic blend" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all blending runs locally
            via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
