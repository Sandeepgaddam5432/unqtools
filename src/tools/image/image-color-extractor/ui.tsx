"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { quantize, samplePixels, rgbToHex, type RgbPixel, type Swatch } from "./logic";
import { toast } from "sonner";

export default function ImageColorExtractor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [k, setK] = useState(6);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
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
      setError(null);
      setSwatches([]);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const extract = useCallback(() => {
    if (!image || !canvasRef.current) return;
    setError(null);
    setBusy(true);
    try {
      const canvas = canvasRef.current;
      // Downscale for performance.
      const maxDim = 200;
      const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixels: RgbPixel[] = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! < 128) continue; // skip transparent
        pixels.push({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
      }
      const sampled = samplePixels(pixels, 1000);
      const result = quantize(sampled, { k, maxIterations: 12, seed: 1 });
      if ("error" in result) {
        setError(result.error);
        setBusy(false);
        return;
      }
      setSwatches(result);
      setBusy(false);
      toast.success(`Extracted ${result.length} colors`);
    } catch {
      setError("Color extraction failed");
      setBusy(false);
    }
  }, [image, k]);

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
              <Label className="text-xs text-muted-foreground">Number of colors: {k}</Label>
              <input
                type="range"
                min={2}
                max={12}
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <Button size="sm" onClick={extract} disabled={busy}>
              {busy ? "Extracting…" : "Extract colors"}
            </Button>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {swatches.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Extracted palette</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {swatches.map((s, i) => (
                <div key={i} className="rounded-md border p-2 space-y-1">
                  <div
                    className="h-12 w-full rounded"
                    style={{ backgroundColor: s.hex }}
                    aria-label={`Color ${s.hex}`}
                  />
                  <div className="flex items-center justify-between gap-1">
                    <code className="text-xs font-mono">{s.hex}</code>
                    <CopyButton getText={() => s.hex} label="" size="icon-sm" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    rgb({s.color.r}, {s.color.g}, {s.color.b}) · {Math.round(s.weight * 100)}%
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
            <strong className="text-foreground">Privacy:</strong> color extraction runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
