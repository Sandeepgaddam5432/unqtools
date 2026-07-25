"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner } from "../../_shared";
import { calculateResize, RESIZE_PRESETS } from "./logic";
import { toast } from "sonner";

export default function ImageResizer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("resized.png");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [scale, setScale] = useState("");
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
      setWidth(String(img.naturalWidth));
      setHeight(String(img.naturalHeight));
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-resized.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const applyResize = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const w = width.trim() === "" ? undefined : Number(width);
    const h = height.trim() === "" ? undefined : Number(height);
    const s = scale.trim() === "" ? undefined : Number(scale);
    const result = calculateResize({
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      targetWidth: w,
      targetHeight: h,
      lockAspect,
      scalePercent: s,
    });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, result.width, result.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, width, height, scale, lockAspect, format, quality, previewUrl]);

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

  const onWidthChange = (v: string) => {
    setWidth(v);
    if (lockAspect && image && v !== "") {
      const n = Number(v);
      if (n > 0) setHeight(String(Math.round((n / image.naturalWidth) * image.naturalHeight)));
    }
  };
  const onHeightChange = (v: string) => {
    setHeight(v);
    if (lockAspect && image && v !== "") {
      const n = Number(v);
      if (n > 0) setWidth(String(Math.round((n / image.naturalHeight) * image.naturalWidth)));
    }
  };

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
          {image && (
            <p className="text-xs text-muted-foreground">
              Original: {image.naturalWidth} × {image.naturalHeight}px
            </p>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {RESIZE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWidth(String(p.width));
                    setHeight(String(p.height));
                    setLockAspect(false);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Width</Label>
                <Input type="number" value={width} onChange={(e) => onWidthChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Height</Label>
                <Input type="number" value={height} onChange={(e) => onHeightChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Scale %</Label>
                <Input type="number" value={scale} onChange={(e) => setScale(e.target.value)} placeholder="100" />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={lockAspect} onCheckedChange={setLockAspect} id="lock" />
                <Label htmlFor="lock" className="text-xs cursor-pointer">Lock</Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
                  <Input
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
              <Button size="sm" onClick={applyResize}>Apply</Button>
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
            <img src={previewUrl} alt="Resized preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all resizing runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
