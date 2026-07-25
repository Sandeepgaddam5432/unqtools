"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeThumbnail,
  thumbnailFilename,
  thumbnailFilenameDims,
  formatExtension,
  estimateTotalBytes,
  SIZE_PRESETS,
  findSizePreset,
  type OutputFormat,
} from "./logic";
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
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.85);
  const [square, setSquare] = useState(false);
  const [stripMetadata, setStripMetadata] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<number[]>([128, 256, 512]);
  const [customSize, setCustomSize] = useState<number | "">("");
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

  const toggleSize = (size: number) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size].sort((a, b) => a - b),
    );
  };

  const addCustomSize = () => {
    if (typeof customSize !== "number") return;
    if (customSize < 8 || customSize > 4096) {
      setError("Custom size must be 8..4096");
      return;
    }
    if (!selectedSizes.includes(customSize)) {
      setSelectedSizes([...selectedSizes, customSize].sort((a, b) => a - b));
    }
    setCustomSize("");
  };

  const generate = useCallback(() => {
    if (!image || !canvasRef.current || selectedSizes.length === 0) return;
    const newItems: ThumbItem[] = [];
    for (const size of selectedSizes) {
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
  }, [image, square, format, quality, selectedSizes]);

  const downloadAll = useCallback(() => {
    const ext = formatExtension(format);
    for (const item of items) {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = square
        ? thumbnailFilename(baseName, item.size, ext)
        : thumbnailFilenameDims(baseName, item.width, item.height, ext);
      a.click();
    }
    toast.success("Downloaded all thumbnails");
  }, [items, baseName, format, square]);

  const totalBytes = estimateTotalBytes(
    items.map((i) => ({ width: i.width, height: i.height, scale: 1 })),
    format,
    quality,
  );

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
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Sizes</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SIZE_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    variant={selectedSizes.includes(p.size) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSize(p.size)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Custom size</Label>
                <Input
                  type="number"
                  min={8}
                  max={4096}
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-32"
                />
              </div>
              <Button variant="outline" size="sm" onClick={addCustomSize}>Add</Button>
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Base name</Label>
                <Input value={baseName} onChange={(e) => setBaseName(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as OutputFormat)}
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
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={stripMetadata} onCheckedChange={setStripMetadata} id="strip" />
                <Label htmlFor="strip" className="text-sm cursor-pointer">Strip metadata</Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={generate}>Generate thumbnails</Button>
              <Button variant="outline" size="sm" onClick={downloadAll} disabled={items.length === 0}>
                Download all
              </Button>
              <CopyButton
                getText={() => JSON.stringify({ sizes: selectedSizes, format, quality, square })}
                label="Copy settings"
                disabled={items.length === 0}
              />
            </div>
            {items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimated total: ~{(totalBytes / 1024).toFixed(1)} KB
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {items.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {items.map((item, idx) => (
                <div key={`${item.size}-${idx}`} className="space-y-1">
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
