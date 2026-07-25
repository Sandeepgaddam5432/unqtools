"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { computeCollageLayout, fitCover, COLLAGE_PRESETS } from "./logic";
import { toast } from "sonner";

interface LoadedImage {
  img: HTMLImageElement;
  name: string;
}

export default function ImageCollageMaker() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [columns, setColumns] = useState(2);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [gap, setGap] = useState(10);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newImages: LoadedImage[] = [];
    let remaining = Array.from(files).filter((f) => f.type.startsWith("image/")).length;
    if (remaining === 0) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        newImages.push({ img, name: file.name });
        remaining--;
        if (remaining === 0) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      img.src = url;
    });
  }, []);

  const apply = useCallback(() => {
    if (images.length === 0 || !canvasRef.current) {
      setError("Please choose at least one image");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const layout = computeCollageLayout({
        imageCount: images.length,
        columns,
        canvasWidth,
        canvasHeight,
        gap,
      });
      if ("error" in layout) {
        setError(layout.error);
        setBusy(false);
        return;
      }
      const canvas = canvasRef.current;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      layout.cells.forEach((cell, i) => {
        const loaded = images[i];
        if (!loaded) return;
        const fit = fitCover(loaded.img.naturalWidth, loaded.img.naturalHeight, cell.width, cell.height);
        if ("error" in fit) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cell.x, cell.y, cell.width, cell.height);
        ctx.clip();
        ctx.drawImage(
          loaded.img,
          cell.x + fit.offsetX,
          cell.y + fit.offsetY,
          fit.width,
          fit.height,
        );
        ctx.restore();
      });
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
      setError("Collage failed — too many or too large images");
      setBusy(false);
    }
  }, [images, columns, canvasWidth, canvasHeight, gap, bgColor, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "collage." + (format === "image/png" ? "png" : format === "image/jpeg" ? "jpg" : "webp");
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Collage downloaded");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [format, quality]);

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
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Add images
          </Button>
          {images.length > 0 && (
            <p className="text-xs text-muted-foreground">{images.length} image(s) loaded</p>
          )}
          {images.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setImages([])}>Clear</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {COLLAGE_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setColumns(p.columns);
                  setCanvasWidth(p.width);
                  setCanvasHeight(p.height);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Columns</Label>
              <Input type="number" value={columns} onChange={(e) => setColumns(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Gap</Label>
              <Input type="number" value={gap} onChange={(e) => setGap(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">BG</Label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="block h-9 w-full rounded border"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
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
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={apply} disabled={busy || images.length === 0}>
              {busy ? "Building…" : "Build collage"}
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Collage preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> collage composition runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
