"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner } from "../../_shared";
import {
  computePlacement,
  computeTilePlacements,
  validateOptions,
  POSITIONS,
  type WatermarkPosition,
  type WatermarkOptions,
} from "./logic";
import { toast } from "sonner";

export default function ImageWatermarkAdder() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("watermarked.png");
  const [text, setText] = useState("© UnQTools");
  const [position, setPosition] = useState<WatermarkPosition>("bottom-right");
  const [opacity, setOpacity] = useState(0.6);
  const [fontSize, setFontSize] = useState(32);
  const [color, setColor] = useState("#ffffff");
  const [rotation, setRotation] = useState(-30);
  const [padding, setPadding] = useState(20);
  const [tile, setTile] = useState(false);
  const [tileSpacing, setTileSpacing] = useState(150);
  const [format, setFormat] = useState("image/png");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const opts: WatermarkOptions = {
    text,
    position,
    opacity,
    fontSize,
    color,
    rotation,
    padding,
    tile,
    tileSpacing,
  };

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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-watermarked.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const render = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateOptions(opts);
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
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px sans-serif`;
    const placements = tile
      ? computeTilePlacements(canvas.width, canvas.height, tileSpacing)
      : [computePlacement(canvas.width, canvas.height, position, padding)];
    for (const p of placements) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.textAlign = p.align;
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : 0.92,
    );
  }, [image, opts, position, padding, tile, tileSpacing, opacity, color, fontSize, rotation, text, format, previewUrl]);

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
      format === "image/png" ? undefined : 0.92,
    );
  }, [fileName, format]);

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
              <Label className="text-xs text-muted-foreground">Watermark text</Label>
              <Input value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Position</Label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as WatermarkPosition)}
                className="h-9 rounded-md border bg-background px-3 text-sm w-full"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Opacity: {Math.round(opacity * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Font size: {fontSize}px</Label>
                <Input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rotation: {rotation}°</Label>
                <Input
                  type="number"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Padding: {padding}px</Label>
                <Input
                  type="number"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Color</Label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="block h-9 w-16 rounded border"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={tile} onCheckedChange={setTile} id="tile" />
                <Label htmlFor="tile" className="text-sm cursor-pointer">Tile</Label>
              </div>
              {tile && (
                <div>
                  <Label className="text-xs text-muted-foreground">Tile spacing: {tileSpacing}px</Label>
                  <Input
                    type="number"
                    value={tileSpacing}
                    onChange={(e) => setTileSpacing(Number(e.target.value))}
                    className="w-28"
                  />
                </div>
              )}
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
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={render}>Apply watermark</Button>
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
            <img src={previewUrl} alt="Watermarked preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> watermarking runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
