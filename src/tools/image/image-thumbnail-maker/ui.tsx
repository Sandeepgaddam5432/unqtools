"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner } from "../../_shared";
import { computeThumbnail, DEFAULT_SIZES, thumbnailFilename } from "./logic";
import { toast } from "sonner";

interface ThumbItem {
  size: number;
  url: string;
  width: number;
  height: number;
}

export default function ImageThumbnailMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [baseName, setBaseName] = useState("thumbnail");
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.85);
  const [square, setSquare] = useState(false);
  const [items, setItems] = useState<ThumbItem[]>([]);
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
      setBaseName(file.name.replace(/\.[^.]+$/, ""));
      setError(null);
      setItems([]);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const generate = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const newItems: ThumbItem[] = [];
    for (const size of DEFAULT_SIZES) {
      const result = computeThumbnail({
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
        maxSize: size,
        square,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const canvas = canvasRef.current;
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      if (square) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
        const w = image.naturalWidth * scale;
        const h = image.naturalHeight * scale;
        ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      } else {
        ctx.drawImage(image, 0, 0, result.width, result.height);
      }
      const url = canvas.toDataURL(format, format === "image/png" ? undefined : quality);
      newItems.push({ size, url, width: result.width, height: result.height });
    }
    setItems(newItems);
    setError(null);
    toast.success(`Generated ${newItems.length} thumbnails`);
  }, [image, square, format, quality]);

  const downloadAll = useCallback(() => {
    const ext = format === "image/png" ? "png" : format === "image/jpeg" ? "jpg" : "webp";
    for (const item of items) {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = thumbnailFilename(baseName, item.size, ext);
      a.click();
    }
    toast.success("Downloaded all thumbnails");
  }, [items, baseName, format]);

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
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Base name</Label>
                <Input value={baseName} onChange={(e) => setBaseName(e.target.value)} className="w-40" />
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
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={square} onCheckedChange={setSquare} id="square" />
                <Label htmlFor="square" className="text-sm cursor-pointer">Square</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={generate}>Generate thumbnails</Button>
              <Button variant="outline" size="sm" onClick={downloadAll} disabled={items.length === 0}>
                Download all
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {items.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {items.map((item) => (
                <div key={item.size} className="space-y-1">
                  <img
                    src={item.url}
                    alt={`Thumbnail ${item.size}`}
                    className="w-full h-24 object-contain rounded border bg-muted/30"
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    {item.width}×{item.height}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> thumbnail generation runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
