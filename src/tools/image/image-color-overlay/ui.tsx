"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { blendPixel, parseHex, BLEND_MODES, type BlendMode } from "./logic";
import { toast } from "sonner";

export default function ImageColorOverlay() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hex, setHex] = useState("#ff8800");
  const [opacity, setOpacity] = useState(0.5);
  const [mode, setMode] = useState<BlendMode>("overlay");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const overlay = useMemo(() => parseHex(hex), [hex]);

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
    if ("error" in overlay) {
      setError(overlay.error);
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
    for (let i = 0; i < data.data.length; i += 4) {
      const out = blendPixel(
        { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] },
        overlay,
        opacity,
        mode,
      );
      data.data[i] = out.r;
      data.data[i + 1] = out.g;
      data.data[i + 2] = out.b;
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Overlay applied");
    }, "image/png");
  }, [image, overlay, opacity, mode, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "overlay.png";
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
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Overlay color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  className="h-9 w-12 rounded border"
                />
                <Input
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  className="w-32 font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Blend mode</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as BlendMode)}
              >
                {BLEND_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Opacity: {Math.round(opacity * 100)}%
              </Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={apply} disabled={!image}>
              Apply overlay
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
              alt="Overlay preview"
              className="max-w-full rounded-md border"
            />
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
