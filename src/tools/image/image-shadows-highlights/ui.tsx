"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { adjustPixel, validateAmount } from "./logic";
import { toast } from "sonner";

export default function ImageShadowsHighlights() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [shadows, setShadows] = useState(30);
  const [highlights, setHighlights] = useState(30);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sv = useMemo(() => validateAmount(shadows), [shadows]);
  const hv = useMemo(() => validateAmount(highlights), [highlights]);

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
    if (typeof sv !== "number" || typeof hv !== "number") {
      setError("Amounts must be between 0 and 100");
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
    const sLift = sv / 100;
    const hAmt = hv / 100;
    for (let i = 0; i < data.data.length; i += 4) {
      const out = adjustPixel(
        { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] },
        sLift,
        hAmt,
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
      toast.success("Shadows/Highlights applied");
    }, "image/png");
  }, [image, sv, hv, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shadows-highlights.png";
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
              <Label className="text-xs text-muted-foreground">Shadows: {shadows}</Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={shadows}
                onChange={(e) => setShadows(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Highlights: {highlights}
              </Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={highlights}
                onChange={(e) => setHighlights(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={apply} disabled={!image}>
              Apply
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
          </div>
          {image && (
            <Badge variant="secondary">
              {image.naturalWidth}×{image.naturalHeight}px
            </Badge>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <img
              src={previewUrl}
              alt="Adjusted preview"
              className="max-w-full rounded-md border"
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all adjustments run
            locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
