"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import {
  darkChannelValue,
  estimateAirlight,
  estimateTransmission,
  recoverPixel,
  validateOmega,
} from "./logic";
import { toast } from "sonner";

export default function ImageDehazeTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [omega, setOmega] = useState(0.95);
  const [airlight, setAirlight] = useState<{ r: number; g: number; b: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const omegaValid = useMemo(() => validateOmega(omega), [omega]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setAirlight(null);
      setPreviewUrl(null);
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const dehaze = useCallback(() => {
    if (!image || !canvasRef.current) return;
    if (typeof omegaValid !== "number") {
      setError(omegaValid.error);
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

    // Build pixel + dark channel arrays.
    const pixels = [];
    const darks: number[] = [];
    for (let i = 0; i < data.data.length; i += 4) {
      const px = { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] };
      pixels.push(px);
      darks.push(darkChannelValue(px));
    }
    const air = estimateAirlight(pixels, darks);
    if ("error" in air) {
      setError(air.error);
      return;
    }
    setAirlight(air);

    for (let i = 0; i < pixels.length; i++) {
      const t = estimateTransmission(pixels[i], air, omegaValid);
      const out = recoverPixel(pixels[i], air, t);
      const di = i * 4;
      data.data[di] = out.r;
      data.data[di + 1] = out.g;
      data.data[di + 2] = out.b;
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Dehaze complete");
    }, "image/png");
  }, [image, omegaValid, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dehazed.png";
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
              <Label className="text-xs text-muted-foreground">
                Strength (omega): {omega.toFixed(2)}
              </Label>
              <Input
                type="range"
                min={50}
                max={100}
                value={Math.round(omega * 100)}
                onChange={(e) => setOmega(Number(e.target.value) / 100)}
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={dehaze} disabled={!image}>
              Dehaze
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
          </div>
          {airlight && (
            <Badge variant="secondary">
              Airlight: rgb({airlight.r}, {airlight.g}, {airlight.b})
            </Badge>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <img src={previewUrl} alt="Dehazed" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all dehazing runs locally
            via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
